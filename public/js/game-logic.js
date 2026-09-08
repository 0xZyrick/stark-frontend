

let moveLog = [];
let isLoggingEnabled = false;

// =============================================
// MOVE TYPES
// =============================================

const MOVE_TYPES = {
    DROP: 'drop',
    MERGE: 'merge',
    HOLD: 'hold',
};

// =============================================
// LOG FUNCTIONS
// =============================================

/**
 * Log a drop action
 * @param {number} col - Column where orb was dropped
 * @param {number} value - Value of the dropped orb
 * @param {number} nextValue - Value of the next orb in queue
 * @param {boolean} isModifier - Whether this was a modifier orb
 */
export function logDrop(col, value, nextValue, isModifier = false) {
    if (!isLoggingEnabled) return;
    
    moveLog.push({
        type: MOVE_TYPES.DROP,
        col: col,
        value: value,
        nextValue: nextValue || 0,
        isModifier: isModifier,
        timestamp: Date.now(),
    });
}

/**
 * Log a merge action
 * @param {number} col - Column where merge happened
 * @param {number} row - Row where merge happened
 * @param {number} newValue - New value after merge
 * @param {number} chainCount - Current chain count
 */
export function logMerge(col, row, newValue, chainCount = 1) {
    if (!isLoggingEnabled) return;
    
    moveLog.push({
        type: MOVE_TYPES.MERGE,
        col: col,
        row: row || 0,
        value: newValue,
        chainCount: chainCount,
        timestamp: Date.now(),
    });
}

/**
 * Log a hold action (swap loaded orb with held orb)
 * @param {number} col - Current column (usually 0)
 * @param {number} loadedValue - Value of the loaded orb
 * @param {number} heldValue - Value of the held orb (0 if empty)
 */
export function logHold(col, loadedValue, heldValue = 0) {
    if (!isLoggingEnabled) return;
    
    moveLog.push({
        type: MOVE_TYPES.HOLD,
        col: col || 0,
        value: loadedValue,
        heldValue: heldValue || 0,
        timestamp: Date.now(),
    });
}

// =============================================
// MOVE LOG MANAGEMENT
// =============================================

/**
 * Enable or disable move logging
 * @param {boolean} enabled - Whether logging should be enabled
 */
export function setLoggingEnabled(enabled) {
    isLoggingEnabled = enabled;
    if (!enabled) {
        moveLog = [];
    }
}

/**
 * Reset the move log (clears all recorded moves)
 */
export function resetMoveLog() {
    moveLog = [];
}

/**
 * Get the current move log
 * @returns {Array} Copy of the move log
 */
export function getMoveLog() {
    return [...moveLog];
}

/**
 * Get the number of moves recorded
 * @returns {number} Move count
 */
export function getMoveCount() {
    return moveLog.length;
}

/**
 * Check if logging is enabled
 * @returns {boolean} Whether logging is enabled
 */
export function isLogging() {
    return isLoggingEnabled;
}

// =============================================
// COMPRESSION & HASHING
// =============================================

/**
 * Compress move log into a compact array of integers
 * Each move is packed into a 32-bit integer:
 * - Bits 30-31: Action type (0=drop, 1=merge, 2=hold)
 * - Bits 24-29: Column (6 bits)
 * - Bits 20-23: Row (4 bits)
 * - Bits 16-19: Chain count (4 bits)
 * - Bits 8-15: Value (8 bits)
 * - Bits 0-7: Extra (nextValue, heldValue, or isModifier)
 * 
 * @param {Array} moves - Array of move objects
 * @returns {number[]} Compressed array
 */
export function compressMoves(moves) {
    if (!moves || moves.length === 0) return [];
    
    const compressed = [];
    
    for (const move of moves) {
        let packed = 0;
        
        // Action type (bits 30-31)
        let actionCode = 0;
        if (move.type === MOVE_TYPES.DROP) actionCode = 0;
        else if (move.type === MOVE_TYPES.MERGE) actionCode = 1;
        else if (move.type === MOVE_TYPES.HOLD) actionCode = 2;
        packed |= (actionCode << 30);
        
        // Column (bits 24-29)
        packed |= ((move.col || 0) & 0x3F) << 24;
        
        // Row (bits 20-23) - only for merges
        if (move.type === MOVE_TYPES.MERGE) {
            packed |= ((move.row || 0) & 0x0F) << 20;
        }
        
        // Chain count (bits 16-19) - only for merges
        if (move.type === MOVE_TYPES.MERGE) {
            packed |= ((move.chainCount || 1) & 0x0F) << 16;
        }
        
        // Value (bits 8-15)
        // For drops: the dropped value
        // For merges: the new value after merge
        // For holds: the loaded value
        const val = move.value || 0;
        packed |= (val & 0xFF) << 8;
        
        // Extra (bits 0-7)
        let extra = 0;
        if (move.type === MOVE_TYPES.DROP) {
            // nextValue in lower 4 bits, isModifier in bit 4
            extra = (move.nextValue || 0) & 0x0F;
            if (move.isModifier) extra |= 0x10;
        } else if (move.type === MOVE_TYPES.HOLD) {
            // heldValue in lower 4 bits
            extra = (move.heldValue || 0) & 0x0F;
        }
        packed |= extra;
        
        compressed.push(packed);
    }
    
    return compressed;
}

/**
 * Decompress moves from compressed format
 * @param {number[]} compressed - Array of packed integers
 * @returns {Array} Array of move objects
 */
export function decompressMoves(compressed) {
    if (!compressed || compressed.length === 0) return [];
    
    const moves = [];
    
    for (const packed of compressed) {
        const actionCode = (packed >> 30) & 0x03;
        const col = (packed >> 24) & 0x3F;
        const row = (packed >> 20) & 0x0F;
        const chainCount = (packed >> 16) & 0x0F;
        const value = (packed >> 8) & 0xFF;
        const extra = packed & 0xFF;
        
        let move = { col, value };
        
        if (actionCode === 0) {
            // DROP
            move.type = MOVE_TYPES.DROP;
            move.nextValue = extra & 0x0F;
            move.isModifier = !!(extra & 0x10);
        } else if (actionCode === 1) {
            // MERGE
            move.type = MOVE_TYPES.MERGE;
            move.row = row;
            move.chainCount = chainCount || 1;
        } else if (actionCode === 2) {
            // HOLD
            move.type = MOVE_TYPES.HOLD;
            move.heldValue = extra & 0x0F;
        }
        
        moves.push(move);
    }
    
    return moves;
}

/**
 * Hash the move log for verification
 * Uses a simple but effective hashing algorithm
 * @param {Array} moves - Array of move objects
 * @returns {string} Hex string of the hash
 */
export function hashMoves(moves) {
    if (!moves || moves.length === 0) return '0x0';
    
    // Compress first
    const compressed = compressMoves(moves);
    
    // Simple hash: XOR all values with multiplication
    let h = BigInt(0x1b3); // Starting seed
    const MOD = (1n << 250n) - 1n; // Prime modulus for felt252 compatibility
    
    for (const val of compressed) {
        h = ((h ^ BigInt(val)) * BigInt(0x100000001b3n)) & MOD;
    }
    
    // Add move count and timestamp for extra security
    h = ((h ^ BigInt(moves.length)) * BigInt(0x100000001b3n)) & MOD;
    const timestamp = moves[moves.length - 1]?.timestamp || 0;
    h = ((h ^ BigInt(timestamp)) * BigInt(0x100000001b3n)) & MOD;
    
    return '0x' + h.toString(16);
}

/**
 * Generate a checksum for the entire run
 * Combines seed, score, depth, best_tile, and moves_hash
 * @param {string} seed - The run seed from the contract
 * @param {number} score - Final score
 * @param {number} depth - Final depth reached
 * @param {number} bestTile - Highest tile value achieved
 * @param {string} movesHash - Hash of the move log
 * @returns {string} Checksum hex string
 */
export function generateChecksum(seed, score, depth, bestTile, movesHash) {
    if (!seed) return '0x0';
    
    let h = BigInt(seed);
    const MOD = (1n << 250n) - 1n;
    
    // Mix in all values
    const mix = (h, n) => ((h ^ BigInt(n)) * BigInt(0x100000001b3n)) & MOD;
    
    h = mix(h, score || 0);
    h = mix(h, depth || 0);
    h = mix(h, bestTile || 0);
    h = mix(h, BigInt(movesHash) || 0n);
    
    return '0x' + h.toString(16);
}

// =============================================
// VALIDATION HELPERS
// =============================================

/**
 * Validate that a move log is well-formed
 * @param {Array} moves - Array of move objects
 * @returns {boolean} Whether the log is valid
 */
export function validateMoveLog(moves) {
    if (!moves || moves.length === 0) return false;
    
    for (const move of moves) {
        // Check required fields
        if (!move.type) return false;
        if (move.col === undefined || move.col === null) return false;
        if (move.value === undefined || move.value === null) return false;
        
        // Validate based on type
        if (move.type === MOVE_TYPES.DROP) {
            if (move.nextValue === undefined) return false;
        } else if (move.type === MOVE_TYPES.MERGE) {
            if (move.row === undefined) return false;
            if (move.chainCount === undefined) return false;
        } else if (move.type === MOVE_TYPES.HOLD) {
            if (move.heldValue === undefined) return false;
        } else {
            return false; // Unknown type
        }
    }
    
    return true;
}

/**
 * Get a summary of the run from the move log
 * @param {Array} moves - Array of move objects
 * @returns {Object} Run summary
 */
export function summarizeRun(moves) {
    if (!moves || moves.length === 0) {
        return { totalMoves: 0, drops: 0, merges: 0, holds: 0, maxChain: 0 };
    }
    
    let drops = 0;
    let merges = 0;
    let holds = 0;
    let maxChain = 0;
    let maxValue = 0;
    
    for (const move of moves) {
        if (move.type === MOVE_TYPES.DROP) drops++;
        else if (move.type === MOVE_TYPES.MERGE) {
            merges++;
            if (move.chainCount > maxChain) maxChain = move.chainCount;
            if (move.value > maxValue) maxValue = move.value;
        } else if (move.type === MOVE_TYPES.HOLD) holds++;
    }
    
    return {
        totalMoves: moves.length,
        drops,
        merges,
        holds,
        maxChain,
        maxValue,
    };
}

// =============================================
// EXPORT
// =============================================

// For use in browser
if (typeof window !== 'undefined') {
    window.GameLog = {
        logDrop,
        logMerge,
        logHold,
        resetMoveLog,
        getMoveLog,
        getMoveCount,
        setLoggingEnabled,
        isLogging,
        compressMoves,
        decompressMoves,
        hashMoves,
        generateChecksum,
        validateMoveLog,
        summarizeRun,
        MOVE_TYPES,
    };
}

// For ES module imports
export default {
    logDrop,
    logMerge,
    logHold,
    resetMoveLog,
    getMoveLog,
    getMoveCount,
    setLoggingEnabled,
    isLogging,
    compressMoves,
    decompressMoves,
    hashMoves,
    generateChecksum,
    validateMoveLog,
    summarizeRun,
    MOVE_TYPES,
};