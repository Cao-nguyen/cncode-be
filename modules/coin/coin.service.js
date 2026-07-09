const CoinTransaction = require('./coin.model');
const User = require('../user/user.model');
const { getIO } = require('../../services/socket.service');

class CoinService {
    async createTransaction(data) {
        const { userId, type, amount, reason, relatedId, relatedType } = data;
        
        // Get current user balance
        const user = await User.findById(userId);
        if (!user) throw new Error('User not found');
        
        const balanceBefore = user.coins;
        const balanceAfter = type === 'credit' ? balanceBefore + amount : balanceBefore - amount;
        
        // Create transaction record
        const transaction = await CoinTransaction.create({
            userId,
            type,
            amount,
            reason,
            relatedId,
            relatedType,
            balanceAfter
        });
        
        // Emit socket event for realtime update
        try {
            const io = getIO();
            if (io) {
                const roomId = userId.toString();
                io.to(roomId).emit('new_coin_transaction', {
                    transaction,
                    currentBalance: balanceAfter
                });
            }
        } catch (err) {
            console.error('[CoinService] Failed to emit socket event:', err);
        }
        
        return transaction;
    }

    async getUserTransactions(userId) {
        const transactions = await CoinTransaction.find({ userId })
            .sort({ createdAt: -1 })
            .lean();
        return transactions;
    }

    async getTransactionById(id) {
        const transaction = await CoinTransaction.findById(id).lean();
        return transaction;
    }
}

module.exports = new CoinService();
