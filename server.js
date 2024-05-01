const express = require("express");
require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const MongodbSession = require("connect-mongodb-session")(session);

//file import
const { userDataValidation, isEmailRgex } = require("./utils/authUtils");
const { json } = require("body-parser");
const userModel = require("./models/userModel");
const { isAuth } = require("./middleware/isAuth");
const { todoDataValidation } = require("./utils/todoUtils");
const todoModel = require("./models/todoModel");
const rateLimiting = require("./middleware/rateLimiting");

//constants
const app = express();
const PORT = process.env.PORT || 8000;
const store = new MongodbSession({
  uri: process.env.MONGO_URL,
  collection: "sessions",
});
const Schema = mongoose.Schema;

//Db connection
mongoose
  .connect(process.env.MONGO_URL)
  .then(() => console.log("Connection established with MongoDB"))
  .catch((err) => console.log(err));

//middlewares
app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));
app.use(json());

app.use(
  session({
    secret: process.env.SECRET_KEY,
    store: store,
    resave: false,
    saveUninitialized: false,
  })
);

app.use(express.static("public"));

app.get("/", (req, res) => {
  res.render("server");
});

app.get("/register", (req, res) => {
  res.render("registerPage");
});

app.post("/register-user", async (req, res) => {
  const { name, email, username, password } = req.body;

  //Data validation
  try {
    await userDataValidation({ name, email, username, password });
  } catch (error) {
    return res.send({
      status: 400,
      message: error.message,
    });
  }

  try {
    //check is email exists

    const isEmailExists = await userModel.findOne({ email: email });
    if (isEmailExists) {
      return res.status(400).json("Email already exist");
    }

    //check if username exist

    const isUsernameExist = await userModel.findOne({ username });
    if (isUsernameExist) {
      return res.status(400).json("Username already exist");
    }

    //hashing of the password

    const hashedPassword = await bcrypt.hash(
      password,
      Number(process.env.SALT)
    );

    const userObj = new userModel({
      name: name,
      email: email,
      username: username,
      password: hashedPassword,
    });

    //store the data

    const userDb = await userObj.save();

    return res.redirect("/login");
  } catch (error) {
    return res.send({
      status: 500,
      message: "Internal Server Error",
      error: error,
    });
  }
});

app.get("/login", (req, res) => {
  res.render("loginPage");
});

app.post("/login-user", async (req, res) => {
  const { loginId, password } = req.body;

  if (!loginId || !password) {
    return res.send({
      status: 400,
      message: "Missing user Credentials",
    });
  }

  //find the user with loginId
  let userDb;
  try {
    if (isEmailRgex({ str: loginId })) {
      userDb = await userModel.findOne({ email: loginId });
    } else {
      userDb = await userModel.findOne({ username: loginId });
    }

    console.log(userDb);

    if (!userDb) {
      return res.send({
        status: 400,
        message: "Invalid Credentials",
      });
    }

    //compare the password
    const isMatched = await bcrypt.compare(password, userDb.password);

    if (!isMatched) {
      return res.send({
        status: 400,
        message: "Password is incorrect",
      });
    }

    //session based authentication
    console.log(req.session);
    req.session.isAuth = true;
    req.session.user = {
      username: userDb.username,
      email: userDb.email,
      userId: userDb._id, //BSON error userDb._id.toString()
    };

    return res.redirect("/dashboard");
  } catch (error) {
    return res.send({
      status: 500,
      message: "Internal Server Error",
      error: error,
    });
  }
});

app.get("/dashboard", isAuth, (req, res) => {
  console.log(req.session.id);
  console.log(req.session.isAuth);

  return res.render("dashboard");
});

app.post("/logout", isAuth, (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.send({
        status: 500,
        message: "Internal Server Error",
        error: err,
      });
    }
    return res.redirect("/login");
  });
});

app.post("/logout_from_all_devices", isAuth, async (req, res) => {
  console.log(req.session);
  const { username } = req.session.user;

  //create sessions schema
  const sessionSchema = new Schema({ _id: String }, { strict: false });

  //convert into a model
  const SessionModel = mongoose.model("Session", sessionSchema);

  try {
    //delete the entires
    const deleteDb = await SessionModel.deleteMany({
      "session.user.username": username,
    });

    return res.send({
      status: 200,
      message: "Logged out from all devices successfully",
      data: deleteDb,
    });
  } catch (error) {
    return res.send({
      status: 500,
      message: "Internal Server Error",
      error: error,
    });
  }
});

// todo api
app.post("/create-item", isAuth,rateLimiting, async (req, res) => {
  console.log(req.body);
  const todoText = req.body.todo;
  const username = req.session.user.username;
  try {
    await todoDataValidation({ todoText });
  } catch (error) {
    return res.send({
      status: 400,
      message: error,
    });
  }

  const todoObj = new todoModel({
    todo: todoText,
    username: username,
  });

  try {
    const todoDb = await todoObj.save();

    // const todoObj = await todoModel.create({
    //     todo: todoText,
    //     username: username,
    //   });

    return res.send({
      status: 201,
      message: "Todo created successfully",
      data: todoDb,
    });
  } catch (error) {
    return res.send({
      status: 500,
      message: "Internal Server Error",
      error: error,
    });
  }
});

//read
//read-item?skip=10
app.get("/read-item", isAuth, async (req, res) => {
  const username = req.session.user.username;
  const SKIP = Number(req.query.skip) || 0;
  const LIMIT = 10;

  try {
    // const todoDb = await todoModel.find({ username });
    const todoDb = await todoModel.aggregate([
      {
        $match: {
          username: username,
        },
      },
      {
        $skip: SKIP,
      },
      {
        $limit: LIMIT,
      }
      // {
      //   $facet: {
      //     data: [
      //       {
      //         $skip: SKIP,
      //       },
      //       {
      //         $limit: LIMIT,
      //       },
      //     ],
      //   },
      // },
    ]);
    // console.log(todoDb[0].data);

    if (todoDb.length === 0) {
      return res.send({
        status: 204,
        message: "No todos found",
      });
    }

    return res.send({
      status: 200,
      message: "Todo read successfully",
      data: todoDb,
    });
  } catch (error) {
    return res.send({
      status: 500,
      message: "Internal Server Error",
      error: error,
    });
  }
});

//edit
app.post("/edit-item", isAuth, async (req, res) => {
  const { todoId, newData } = req.body;
  const { username } = req.session.user;

  if (!todoId) {
    return res.send({
      status: 400,
      message: "Missing todoId",
    });
  }

  try {
    await todoDataValidation({ todoText: newData });
  } catch (error) {
    return res.send({
      status: 400,
      message: error,
    });
  }

  //find the todo
  try {
    const todoDb = await todoModel.findOne({ _id: todoId });
    if (!todoDb) {
      return res.send({
        status: 404,
        message: "Todo not found",
      });
    }

    if (todoDb.username !== username) {
      return res.send({
        status: 401,
        message: "Unauthorized",
      });
    }

    const prevTodo = await todoModel.findOneAndUpdate(
      { _id: todoId },
      { todo: newData }
    );

    // const todoUpdate = await todoModel.updateOne(
    //   { _id: todoId },
    //   { todo: newData }
    // );

    return res.send({
      status: 200,
      message: "Todo updated successfully",
      data: prevTodo,
    });
  } catch (error) {
    return res.send({
      status: 500,
      message: "Internal Server Error",
      error: error,
    });
  }
  //edit the todo
});

//delete
app.post("/delete-item", isAuth, async (req, res) => {
  const { todoId } = req.body;
  const { username } = req.session.user;

  if (!todoId) {
    return res.send({
      status: 400,
      message: "Missing todoId",
    });
  }

  //find the todo
  try {
    const todoDb = await todoModel.findOne({ _id: todoId });
    if (!todoDb) {
      return res.send({
        status: 404,
        message: "Todo not found",
      });
    }

    if (todoDb.username !== username) {
      return res.send({
        status: 401,
        message: "Unauthorized to delete",
      });
    }

    const deletedTodo = await todoModel.findOneAndDelete({ _id: todoId });

    // const todoDelete = await todoModel.updateOne(
    //   { _id: todoId },
    // );

    return res.send({
      status: 200,
      message: "Todo deleted successfully",
      data: deletedTodo,
    });
  } catch (error) {
    return res.send({
      status: 500,
      message: "Internal Server Error",
      error: error,
    });
  }
});

app.listen(PORT, () => {
  console.log("Server started on port:");
  console.log(`http://localhost:${PORT}/`);
});
