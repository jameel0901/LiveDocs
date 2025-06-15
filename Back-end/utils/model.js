
const { userSchema, documentSchema } = require("./schema");
const mongoose = require("mongoose");

const connectDb = async () => {
   console.log("Connecting to database...");
   console.log("ATLAS_URI:", process.env.ATLAS_URI);
   console.log("MONGODB_URI:", process.env.MONGODB_URI);
   try {
    if (!process.env.ATLAS_URI) {
      throw new Error('ATLAS_URI environment variable is not defined');
    }
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
const Users = mongoose.models.Users || mongoose.model("Users", userSchema);
const Document = mongoose.models.Document || mongoose.model("Document", documentSchema);

module.exports = { connectDb, Users, Document };
