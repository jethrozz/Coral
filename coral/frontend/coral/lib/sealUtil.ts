import { File } from "@/shared/data";
import { Transaction } from "@mysten/sui/transactions";
import { SuiClient } from "@mysten/sui/client";
import {
  EncryptedObject,
  NoAccessError,
  SealClient,
  SessionKey,
} from "@mysten/seal";
import { fromHex } from "@mysten/sui/utils";
import { RPC_URL, NET_WORK } from "@/constants";

type DownloadData = {
  fileId: string;
  downloadRes: ArrayBuffer;
};

export type MoveCallConstructor = (tx: Transaction, id: string) => void;

// Walrus aggregator URLs
const aggregators = [
  "https://aggregator.walrus-testnet.walrus.space",
  "https://wal-aggregator-testnet.staketab.org",
  "https://walrus-testnet-aggregator.bartestnet.com",
  "https://walrus-testnet.blockscope.net",
  "https://walrus-testnet-aggregator.nodes.guru",
  "https://walrus-cache-testnet.overclock.run",
  "https://sui-walrus-testnet.bwarelabs.com/aggregator",
  "https://walrus-testnet-aggregator.stakin-nodes.com",
  "https://testnet-aggregator-walrus.kiliglab.io",
  "https://walrus-cache-testnet.latitude-sui.com",
  "https://walrus-testnet-aggregator.nodeinfra.com",
  "https://walrus-tn.juicystake.io:9443",
  "https://walrus-agg-testnet.chainode.tech:9002",
  "https://walrus-testnet-aggregator.starduststaking.com:11444",
  "http://walrus-testnet-aggregator.everstake.one:9000",
  "http://walrus.testnet.pops.one:9000",
  "http://scarlet-brussels-376c2.walrus.bdnodes.net:9000",
  "http://aggregator.testnet.sui.rpcpool.com:9000",
  "http://walrus.krates.ai:9000",
  "http://walrus-testnet.stakingdefenseleague.com:9000",
  "http://walrus.sui.thepassivetrust.com:9000",
];

export const downloadAndDecrypt = async (
  files: File[],
  sessionKey: SessionKey,
  moveCallConstructor: MoveCallConstructor,
  setError: (error: string | null) => void,
  setFiles: (files: File[]) => void,
): Promise<void> => {
  const suiClient = new SuiClient({ url: RPC_URL });

  // Seal key server object IDs for testnet
  const serverObjectIds = [
    "0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75",
    "0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8"
  ];

  const sealClient = new SealClient({
    suiClient,
    serverConfigs: serverObjectIds.map((id) => ({
      objectId: id,
      weight: 1,
    })),
    verifyKeyServers: false,
  });

  // First, download all files in parallel (ignore errors)
  const downloadResults = await Promise.all(
    files.map(async (file) => {
      for (let aggregator of aggregators) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10000);
          const aggregatorUrl = `${aggregator}/v1/blobs/${file.blob_id}`;
          const response = await fetch(aggregatorUrl, {
            signal: controller.signal,
          });
          clearTimeout(timeout);
          if (!response.ok) {
            continue;
          }
          let downloadRes = await response.arrayBuffer();
          let downloadData: DownloadData = {
            fileId: file.id,
            downloadRes: downloadRes,
          };

          return downloadData;
        } catch (err) {
          console.error(
            `Blob ${file.blob_id} cannot be retrieved from Walrus`,
            err
          );
          continue;
        }
      }
      return null;
    })
  );

  // Filter out failed downloads
  const validDownloads = downloadResults.filter(
    (result): result is DownloadData => result !== null && result.downloadRes !== null
  );

  console.log("validDownloads ", validDownloads);
  console.log("validDownloads count", validDownloads.length);

  if (validDownloads.length === 0) {
    const errorMsg =
      "Cannot retrieve files from this Walrus aggregator, try again (a randomly selected aggregator will be used). Files uploaded more than 1 epoch ago have been deleted from Walrus.";
    console.error(errorMsg);
    setError(errorMsg);
    return;
  }

  // Fetch keys in batches of <=10
  for (let i = 0; i < validDownloads.length; i += 10) {
    const batch = validDownloads.slice(i, i + 10);
    const batchData = batch.map((data) => data.downloadRes);
    console.log("batch", batchData);
    const ids = batchData.map((enc) => EncryptedObject.parse(new Uint8Array(enc)).id);
    const tx = new Transaction();
    // 为每个 blobId 构建 moveCall
    ids.forEach((id) => moveCallConstructor(tx, id));
    const txBytes = await tx.build({
      client: suiClient,
      onlyTransactionKind: true,
    });
    try {
      await sealClient.fetchKeys({
        ids,
        txBytes,
        sessionKey,
        threshold: 2,
      });
    } catch (err) {
      console.log(err);
      const errorMsg =
        err instanceof NoAccessError
          ? "No access to decryption keys"
          : "Unable to decrypt files, try again";
      console.error(errorMsg, err);
      setError(errorMsg);
      return;
    }
  }

  // Then, decrypt files sequentially
  for (const encryptedData of validDownloads) {
    const fullId = EncryptedObject.parse(
      new Uint8Array(encryptedData.downloadRes)
    ).id;
    const tx = new Transaction();
    moveCallConstructor(tx, fullId);
    const txBytes = await tx.build({
      client: suiClient,
      onlyTransactionKind: true,
    });
    try {
      // Note that all keys are fetched above, so this only local decryption is done
      const decryptedFile = await sealClient.decrypt({
        data: new Uint8Array(encryptedData.downloadRes),
        sessionKey,
        txBytes,
      });
      const textDecoder = new TextDecoder();
      const textContent = textDecoder.decode(decryptedFile);
      console.log("decrypted text content:", textContent);
      // 更新文件内容
      const file = files.find((f) => f.id === encryptedData.fileId);
      if (file) {
        file.content = textContent;
      }
    } catch (err) {
      console.log(err);
      const errorMsg =
        err instanceof NoAccessError
          ? "No access to decryption keys"
          : "Unable to decrypt files, try again";
      console.error(errorMsg, err);
      setError(errorMsg);
      return;
    }
  }

  if (files.length > 0) {
    setFiles([...files]);
  }
};

// 构建订阅者的 MoveCall（为特定文件创建）
export function constructSubscribeMoveCall(
  packageId: string,
  subCapId: string,
  columnId: string,
  paymentMethodId: string,
  fileId: string,
  installmentId: string,
): MoveCallConstructor {
  return (tx: Transaction, id: string) => {
    tx.moveCall({
      target: `${packageId}::coral_market::seal_approve_sub`,
      arguments: [
        tx.pure.vector("u8", fromHex(id)),
        tx.object(subCapId),
        tx.object(columnId),
        tx.object(paymentMethodId),
        tx.object(fileId), // file
        tx.object(installmentId),
        tx.object("0x6"), // clock
      ],
    });
  };
}

// 构建创作者的 MoveCall（为特定文件创建）
export function constructCreatorMoveCall(
  packageId: string,
  colCapId: string,
  columnId: string,
  fileId: string,
): MoveCallConstructor {
  return (tx: Transaction, id: string) => {
    tx.moveCall({
      target: `${packageId}::coral_market::seal_approve_creator`,
      arguments: [
        tx.pure.vector("u8", fromHex(id)),
        tx.object(colCapId),
        tx.object(columnId),
        tx.object(fileId), // file
      ],
    });
  };
}

