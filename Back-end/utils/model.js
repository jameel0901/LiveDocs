
const userData = require("./schema");
const mongoose = require("mongoose");

const connectDb = async () => {
  try {
    const connect = await mongoose.connect(process.env.ATLAS_URI);
    console.log(
      "Database connected: ",
      connect.connection.host,
      connect.connection.name
    );
  } catch (err) {
    console.log(err);
    process.exit(1);
  }
};
const Users = mongoose.models.Users||mongoose.model("Users", userData);

module.exports = { connectDb ,Users };