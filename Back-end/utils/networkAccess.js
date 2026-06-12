const { Network } = require("./model");

const isNetworkMember = async (networkId, userId) => {
  if (!networkId || !userId) return false;

  const network = await Network.findById(networkId).select("members").lean();
  if (!network) return false;

  return (network.members || []).some(
    (entry) => entry.user && entry.user.toString() === userId.toString()
  );
};

const getUserNetworkIds = async (userId) => {
  const networks = await Network.find({ "members.user": userId }).select("_id").lean();
  return networks.map((network) => network._id.toString());
};

module.exports = { isNetworkMember, getUserNetworkIds };
