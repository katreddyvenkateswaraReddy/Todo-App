const isAuth = (req, res, next) => {

    if(req.session.isAuth){
        next(); 
    }
    else{
        return res.send({
            status: 401,
            message: "Session Expired. Please Login Again",
        });
    }
};

module.exports = {isAuth};