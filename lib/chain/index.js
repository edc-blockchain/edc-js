let ChainStore = require("./src/ChainStore");
let TransactionBuilder  = require("./src/TransactionBuilder");
/**
 *
 * @type {{ChainStore: (*|ChainStore), TransactionBuilder: TransactionBuilder, FetchChainObjects: (FetchChainObjects|*), ChainTypes, ObjectId: ObjectId, NumberUtils: *, TransactionHelper, ChainValidation, EmitterInstance: *, Login: (*|AccountLogin), FetchChain: (FetchChain|*)}}
 */
module.exports = {
    ChainStore: ChainStore,
    TransactionBuilder: TransactionBuilder,
    FetchChainObjects: ChainStore.FetchChainObjects,

    ChainTypes: require("./src/ChainTypes"),
    ObjectId: require("./src/ObjectId"),
    NumberUtils: require("./src/NumberUtils"),
    TransactionHelper: require("./src/TransactionHelper"),
    ChainValidation: require("./src/ChainValidation"),
    EmitterInstance: require("./src/EmitterInstance"),
    Login: require("./src/AccountLogin"),

    /** Helper function for FetchChainObjects */
    FetchChain: ChainStore.FetchChain
};
