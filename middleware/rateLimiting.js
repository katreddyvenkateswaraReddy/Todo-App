const accessModel = require("../models/accessModel");

const rateLimiting = async (req, res, next) => {
  //find the entry in accessDb
  const sid = req.sessionID;

  try {
    const accessDb = await accessModel.findOne({ sessionId: sid });

    if (!accessDb) {
      const accessObj = new accessModel({
        sessionId: sid,
        req_time: Date.now(),
      });

      await accessObj.save();
      next();
      return;
    }

    const diff = (Date.now() - accessDb.req_time) / (1000);

    //1hit/second
    if (diff < 1) {
      return res.send({
        status: 400,
        message: "Too many requests",
      });
    }

    //update the time if difference is greater than  logic
    await accessModel.findOneAndUpdate(
      { sessionId: sid },
      { req_time: Date.now() }
    );

    next();

  } catch (error) {
    console.log(error);
    return res.send({
      status: 500,
      message: "Internal Server Error",
      error: error,
    });
  }

  // next();
};

module.exports = rateLimiting;
