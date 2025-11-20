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
import { RPC_URL, NET_WORK, SEAL_SERVER_OBJECT_IDS } from "@/constants";

type DownloadData = {
  fileId: string;
  downloadRes: ArrayBuffer;
};

export type MoveCallConstructor = (tx: Transaction, id: string) => void;

export type MoveCallConstructorWithIds = {
  constructor: MoveCallConstructor;
  objectIds: string[];
};

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
  moveCallConstructor: MoveCallConstructor | MoveCallConstructorWithIds,
  setError: (error: string | null) => void,
  setFiles: (files: File[]) => void,
): Promise<void> => {
  // 处理两种类型的 moveCallConstructor
  const constructor = typeof moveCallConstructor === 'function' 
    ? moveCallConstructor 
    : moveCallConstructor.constructor;
  const objectIds = typeof moveCallConstructor === 'function'
    ? []
    : moveCallConstructor.objectIds;

  const suiClient = new SuiClient({ url: RPC_URL });

  const sealClient = new SealClient({
    suiClient,
    serverConfigs: SEAL_SERVER_OBJECT_IDS.map((id) => ({
      objectId: id,
      weight: 1,
    })),
    verifyKeyServers: false,
  });

  // First, download all files in parallel (ignore errors)
  const downloadResults = await Promise.all(
    files.map(async (file) => {
      if (!file.blob_id) {
        return null;
      }
      
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

  if (validDownloads.length === 0) {
    const errorMsg =
      "Cannot retrieve files from this Walrus aggregator, try again (a randomly selected aggregator will be used). Files uploaded more than 1 epoch ago have been deleted from Walrus.";
    setError(errorMsg);
    return;
  }

  // Fetch keys in batches of <=10
  for (let i = 0; i < validDownloads.length; i += 10) {
    const batch = validDownloads.slice(i, i + 10);
    const batchData = batch.map((data) => data.downloadRes);
    const ids = batchData.map((enc) => {
      const encryptedObj = EncryptedObject.parse(new Uint8Array(enc));
      const id = encryptedObj.id;
      const idStr = typeof id === 'string' ? id : String(id);
      return idStr;
    });
    const tx = new Transaction();
    
    // 为每个 blobId 构建 moveCall
    try {
      ids.forEach((id) => constructor(tx, id));
    } catch (err) {
      setError(`构建交易失败: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }
    
    let txBytes: Uint8Array;
    try {
      // 如果有对象 ID 列表，验证对象是否存在
      if (objectIds.length > 0) {
        const objectInfos = await suiClient.multiGetObjects({
          ids: objectIds,
          options: {
            showType: true,
            showOwner: true,
          }
        })
        
        const missingObjects: string[] = []
        objectInfos.forEach((obj, index) => {
          const objId = objectIds[index]
          if (obj.error || !obj.data) {
            missingObjects.push(objId)
          }
        })
        
        if (missingObjects.length > 0) {
          throw new Error(`以下对象不存在或无法访问: ${missingObjects.join(', ')}`)
        }
      }
      
      txBytes = await tx.build({
        client: suiClient,
        onlyTransactionKind: true,
      });
    } catch (err) {
      setError(`构建交易字节失败: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }
    
    try {
      await sealClient.fetchKeys({
        ids,
        txBytes,
        sessionKey,
        threshold: 2,
      });
    } catch (err) {
      const errorMsg =
        err instanceof NoAccessError
          ? "无访问权限，请检查订阅状态"
          : err instanceof Error && err.message.includes("403")
          ? "访问被拒绝，请检查订阅是否有效且未过期"
          : err instanceof Error && err.message.includes("InvalidParameterError")
          ? "交易参数无效，请检查订阅和期刊信息"
          : "无法解密文件，请重试";
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
    constructor(tx, fullId);
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
      // 更新文件内容
      const file = files.find((f) => f.id === encryptedData.fileId);
      if (file) {
        file.content = textContent;
      }
    } catch (err) {
      const errorMsg =
        err instanceof NoAccessError
          ? "No access to decryption keys"
          : "Unable to decrypt files, try again";
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
): MoveCallConstructorWithIds {
  // 验证所有 ID 都是有效的字符串格式
  const validateObjectId = (id: string, name: string) => {
    if (!id || typeof id !== 'string' || id.length === 0) {
      throw new Error(`Invalid ${name}: ${id}`)
    }
    // 确保 ID 是有效的 Sui 对象 ID 格式（0x 开头，64 个十六进制字符）
    if (!id.startsWith('0x') || id.length < 3) {
      throw new Error(`Invalid ${name} format: ${id}`)
    }
    return id
  }


  const validatedSubCapId = validateObjectId(subCapId, 'subCapId')
  const validatedColumnId = validateObjectId(columnId, 'columnId')
  const validatedPaymentMethodId = validateObjectId(paymentMethodId, 'paymentMethodId')
  const validatedFileId = validateObjectId(fileId, 'fileId')
  const validatedInstallmentId = validateObjectId(installmentId, 'installmentId')
  
  const moveCallFn = (tx: Transaction, id: string) => {
    try {
      // 验证 id 格式
      if (!id || typeof id !== 'string') {
        throw new Error(`Invalid encrypted object id: ${id}`)
      }
      
      // fromHex 将十六进制字符串转换为 Uint8Array
      const idBytes = fromHex(id);
      
      const moveCallArgs = [
        tx.pure.vector("u8", idBytes),
        tx.object(validatedSubCapId),
        tx.object(validatedColumnId),
        tx.object(validatedPaymentMethodId),
        // 注意：不再传入 file 对象，因为 file 不属于订阅者
        // Seal key server 会通过 _id (加密对象 ID) 来验证文件访问权限
        tx.object(validatedInstallmentId),
        tx.object.clock(), // clock - 使用系统对象方法
      ];
      
      tx.moveCall({
        target: `${packageId}::coral_market::seal_approve_sub`,
        arguments: moveCallArgs,
      });
    } catch (error) {
      throw error
    }
  };
  
  return {
    constructor: moveCallFn,
    // 注意：不再包含 validatedFileId，因为 file 对象不属于订阅者
    objectIds: [validatedSubCapId, validatedColumnId, validatedPaymentMethodId, validatedInstallmentId]
  };
}

// 构建创作者的 MoveCall（为特定文件创建）
export function constructCreatorMoveCall(
  packageId: string,
  colCapId: string,
  columnId: string,
  fileId: string,
): MoveCallConstructor {
  // 验证所有 ID 都是有效的字符串格式
  const validateObjectId = (id: string, name: string) => {
    if (!id || typeof id !== 'string' || id.length === 0) {
      throw new Error(`Invalid ${name}: ${id}`)
    }
    // 确保 ID 是有效的 Sui 对象 ID 格式（0x 开头，64 个十六进制字符）
    if (!id.startsWith('0x') || id.length < 3) {
      throw new Error(`Invalid ${name} format: ${id}`)
    }
    return id
  }

  const validatedColCapId = validateObjectId(colCapId, 'colCapId')
  const validatedColumnId = validateObjectId(columnId, 'columnId')
  const validatedFileId = validateObjectId(fileId, 'fileId')

  return (tx: Transaction, id: string) => {
    try {
      // 验证 id 格式
      if (!id || typeof id !== 'string') {
        throw new Error(`Invalid encrypted object id: ${id}`)
      }
      
      // fromHex 将十六进制字符串转换为 Uint8Array
      const idBytes = fromHex(id);
      
      const moveCallArgs = [
        tx.pure.vector("u8", idBytes),
        tx.object(validatedColCapId),
        tx.object(validatedColumnId),
        tx.object(validatedFileId), // file
      ];
      
      tx.moveCall({
        target: `${packageId}::coral_market::seal_approve_creator`,
        arguments: moveCallArgs,
      });
    } catch (error) {
      throw error
    }
  };
}

