export interface Move {
    action: number;
    col: number;
    row: number;
    value: number;
    next_value: number;
    held_value: number;
    chain_count: number;
    is_modifier: boolean;
    timestamp: number;
}

export interface Run {
    player: string;
    score: number;
    depth: number;
    best_tile: number;
    checksum: string;
    timestamp: number;
    season_id: number;
}

export interface PlayerBest {
    best_score: number;
    best_depth: number;
    best_run_id: number;
    total_runs: number;
}

export interface ActiveRun {
    seed: string;
    start_time: number;
    season_id: number;
}