contract;

use {
    std::{
        auth::msg_sender,
        hash::Hash,
    },
};

pub struct Player {
    pub farming_skill: u64,
    pub total_value_sold: u64,
}

abi Counter {
    #[storage(read)]
    fn get_player(id: Identity) -> Option<Player>;

    #[storage(read)]
    fn get_decimal(asset_id: AssetId) -> Option<u64>;
}

storage {
    players: StorageMap<Identity, Player> = StorageMap {},
    decimals: StorageMap<AssetId, u64> = StorageMap {},
}

impl Counter for Contract {
    #[storage(read)]
    fn get_player(id: Identity) -> Option<Player> {
        storage.players.get(id).try_read()
    }

    #[storage(read)]
    fn get_decimal(asset_id: AssetId) -> Option<u64> {
        storage.decimals.get(asset_id).try_read()
    }
}
