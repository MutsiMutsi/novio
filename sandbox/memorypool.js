class MemoryPool {
    constructor(nkn, rpcServerAddr) {
        this.nkn = nkn;
        this.rpcServerAddr = rpcServerAddr;
    }

    async getFee() {
        var mempool = await this.getMempool();

        const sumOfTxCount = mempool.reduce((acc, curr) => {
            return acc + curr.txcount;
        }, 0);

        if (sumOfTxCount < 10) {
            return { min: 0, avg: 0, max: 0.00000001 };
        } else {
            var txList = await this.processMempool();

            // Extract the 'fee' values from the 'result' array
            const fees = txList.map(result => result.fee);

            // Calculate the minimum, maximum, and average of 'fee'
            const minFee = Math.min(...fees);
            const maxFee = Math.max(...fees);
            const avgFee = fees.reduce((acc, curr) => acc + curr, 0) / fees.length;

            return { min: 0, avg: avgFee, max: maxFee + 0.00000001 };
        }
    }

    async getMempool() {
        return nkn.rpc.rpcCall(this.rpcServerAddr, 'getrawmempool', { "action": "addresslist" });
    }

    async getMempoolAddressTxn(address) {
        return nkn.rpc.rpcCall(this.rpcServerAddr, 'getrawmempool', { "action": "txnlist", "address": address });
    }

    async processMempool(mempool) {
        const promises = mempool.map(async item => {
            const addressTxns = await this.getMempoolAddressTxn(item.address);
            return addressTxns;
        });

        const txLists = await Promise.all(promises);
        const flattenedTxList = txLists.flat();

        return flattenedTxList;
    }
}