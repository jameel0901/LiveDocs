const { Users } = require("../utils/model");
const bycrypt = require("bcrypt");
const asyncHandler = require('express-async-handler');

const singupHandler = asyncHandler( async (req,res) => {
   console.log("Req",req);
    const {name,email,password} = req.body;
   if(!name||!email,!password){
      res.status(400);
      res.send("All fields are mandatory")
   };
   const userAlreadyExsits = Users.findOne({email});
   if(userAlreadyExsits){
    res.status(400);
    res.send("User Already Exists with this Email");
   };
   res.send("Request recevied");
   const hasedPassword = await bycrypt.hash(password,10);
   // console.log("HasedPassword",hasedPassword);
   const user = await Users.create({
    name,
    email,
    password : hasedPassword
   });
   if(user){
      res.status(201).json({_id:user.id,email:user.email});
   };
   console.log("user",user)
});

module.exports = singupHandler