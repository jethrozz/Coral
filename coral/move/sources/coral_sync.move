
module coral::coral_sync {
    use sui::clock::Clock;
    use std::string::String;

    public struct Directory has key, store {
        id: object::UID,
        name: String,
        parent: object::ID,
        is_root: bool,
        created_at: u64,
        updated_at: u64,
    }

    public struct File has key, store {
        id: object::UID,
        title: String,
        belong_dir: object::ID,
        blob_id: String,
        end_epoch: u64,
        created_at: u64,
        updated_at: u64,
        belong_installment: option::Option<object::ID>, //所属的installment，用于权限控制
    }

    public fun new_root_directory(name: String, clock: &Clock, ctx: &mut sui::tx_context::TxContext): Directory {
        let now = clock.timestamp_ms();
        let parent_id = @0x0.to_id();
        Directory {
            id: object::new(ctx),
            name,
            parent: parent_id,
            is_root: true,
            created_at: now,
            updated_at: now,
        }
    }

    public fun new_file(title: String, blob_id: String, end_epoch: u64, dir : &mut Directory,clock: &Clock, ctx: &mut sui::tx_context::TxContext): File {
        let now = clock.timestamp_ms();
        let  dir_id = object::id(dir);
        File {
            id: object::new(ctx),
            title,
            blob_id,
            end_epoch,
            belong_dir: dir_id,
            created_at: now,
            updated_at: now,
            belong_installment: option::none(),
        }
    }

    public entry fun transfer_file(file: File, recipient: address) {
        sui::transfer::public_transfer(file, recipient);
    }

    public entry fun transfer_dir(dir: Directory, recipient: address) {
        sui::transfer::public_transfer(dir, recipient);
    }

    public fun new_directory(name: String, parent_dir: & Directory, clock: &Clock, ctx: &mut sui::tx_context::TxContext): Directory {
        let parent_id = object::id(parent_dir);
        let now = clock.timestamp_ms();
        Directory {
            id: object::new(ctx),
            name,
            parent: parent_id,
            is_root: false,
            created_at: now,
            updated_at: now,
        }
    }

    public fun update_directory(name: String, is_root: bool, dir: &mut Directory, clock: &Clock, _ctx: &mut sui::tx_context::TxContext) {
        let now = clock.timestamp_ms();
        dir.updated_at = now;
        dir.name = name;
        dir.is_root = is_root;
    }

    public fun update_file(title: String, blob_id: String, file: &mut File, clock: &Clock, _ctx: &mut sui::tx_context::TxContext) {
        let now = clock.timestamp_ms();
        file.updated_at = now;
        file.title = title;
        file.blob_id = blob_id;
    }
    public fun delete_file(file: File, _ctx: &mut sui::tx_context::TxContext) {
        let File{
            id,
            blob_id: _,
            end_epoch: _,
            belong_dir: _,
            title: _,
            created_at: _,
            updated_at: _,
            belong_installment: _,
        } = file;
        object::delete(id);
    }

    public fun delete_directory(dir: Directory, _ctx: &mut sui::tx_context::TxContext) {
         let Directory {
            id,
            name: _,
            parent: _,
            is_root: _,
            created_at: _,
            updated_at: _,
        } = dir;
        object::delete(id);
    }

    public fun move_file(file: &mut File, new_dir: &Directory, clock: &Clock, _ctx: &mut sui::tx_context::TxContext) {
        let now = clock.timestamp_ms();
        let id = object::id(new_dir);
        file.belong_dir = id;
        file.updated_at = now;
    }

    public fun move_directory(dir: &mut Directory, new_parent_dir: &Directory, clock: &Clock, _ctx: &mut sui::tx_context::TxContext) {
        let now = clock.timestamp_ms();
        let id = object::id(new_parent_dir);
        dir.parent = id;
        dir.updated_at = now;
    }

    // 设置文件所属的installment（只能设置一次）
    public(package) fun set_file_installment(file: &mut File, installment_id: object::ID) {
        assert!(file.belong_installment.is_none(), 9001); // 已经设置过installment
        file.belong_installment = option::some(installment_id);
    }

    // 获取文件所属的installment
    public fun get_file_installment(file: &File): option::Option<object::ID> {
        file.belong_installment
    }

    entry fun seal_approve(_id: vector<u8>, _file: &File) {
    }
}

