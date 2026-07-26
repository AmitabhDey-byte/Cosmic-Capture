#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Symbol};

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    Player(Address),
    Result(u64),
    Cosmetic(Address, Symbol),
}

#[derive(Clone)]
#[contracttype]
pub struct PlayerProfile {
    pub matches: u32,
    pub wins: u32,
    pub cores: u32,
    pub ranking_points: u32,
}

#[derive(Clone)]
#[contracttype]
pub struct MatchResult {
    pub player: Address,
    pub rank: u32,
    pub cores: u32,
    pub verified_at: u64,
}

#[contract]
pub struct StellarArena;

#[contractimpl]
impl StellarArena {
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    pub fn register_player(env: Env, player: Address) {
        player.require_auth();
        let key = DataKey::Player(player);
        if !env.storage().persistent().has(&key) {
            env.storage().persistent().set(
                &key,
                &PlayerProfile {
                    matches: 0,
                    wins: 0,
                    cores: 0,
                    ranking_points: 0,
                },
            );
        }
    }

    // The off-chain game server calls this after anti-cheat verification. It is deliberately
    // limited to final match facts: real-time movement and abilities never touch the chain.
    pub fn record_match(env: Env, match_id: u64, player: Address, rank: u32, cores: u32) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("not initialized");
        admin.require_auth();
        let result_key = DataKey::Result(match_id);
        if env.storage().persistent().has(&result_key) {
            panic!("match result already recorded");
        }
        let player_key = DataKey::Player(player.clone());
        let mut profile: PlayerProfile =
            env.storage()
                .persistent()
                .get(&player_key)
                .unwrap_or(PlayerProfile {
                    matches: 0,
                    wins: 0,
                    cores: 0,
                    ranking_points: 0,
                });
        profile.matches += 1;
        profile.cores += cores;
        if rank == 1 {
            profile.wins += 1;
        }
        profile.ranking_points += points_for_rank(rank);
        env.storage().persistent().set(&player_key, &profile);
        env.storage().persistent().set(
            &result_key,
            &MatchResult {
                player,
                rank,
                cores,
                verified_at: env.ledger().timestamp(),
            },
        );
    }

    // The server may only mint cosmetic ownership after its own payment/reward checks finish.
    pub fn mint_cosmetic(env: Env, player: Address, cosmetic: Symbol) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("not initialized");
        admin.require_auth();
        env.storage()
            .persistent()
            .set(&DataKey::Cosmetic(player, cosmetic), &true);
    }

    pub fn profile(env: Env, player: Address) -> PlayerProfile {
        env.storage()
            .persistent()
            .get(&DataKey::Player(player))
            .unwrap_or(PlayerProfile {
                matches: 0,
                wins: 0,
                cores: 0,
                ranking_points: 0,
            })
    }

    pub fn result(env: Env, match_id: u64) -> MatchResult {
        env.storage()
            .persistent()
            .get(&DataKey::Result(match_id))
            .expect("result not found")
    }

    pub fn owns_cosmetic(env: Env, player: Address, cosmetic: Symbol) -> bool {
        env.storage()
            .persistent()
            .get(&DataKey::Cosmetic(player, cosmetic))
            .unwrap_or(false)
    }
}

fn points_for_rank(rank: u32) -> u32 {
    match rank {
        1 => 240,
        2 => 180,
        3 => 130,
        4 => 90,
        _ => 55,
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    #[test]
    fn records_verified_results_and_cosmetic_ownership() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarArena, ());
        let client = StellarArenaClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        let pilot = Address::generate(&env);
        let comet_pin = Symbol::new(&env, "comet_pin");

        client.initialize(&admin);
        client.register_player(&pilot);
        client.record_match(&42, &pilot, &1, &7);
        client.mint_cosmetic(&pilot, &comet_pin);

        let profile = client.profile(&pilot);
        assert_eq!(profile.matches, 1);
        assert_eq!(profile.wins, 1);
        assert_eq!(profile.cores, 7);
        assert_eq!(profile.ranking_points, 240);
        assert!(client.owns_cosmetic(&pilot, &comet_pin));
    }
}
