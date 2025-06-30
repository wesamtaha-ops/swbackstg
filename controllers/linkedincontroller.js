const User = require('../models/user');
const jwt = require('jsonwebtoken');
const getAccessToken = async (code) => {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: code,
    client_id: process.env.LINKEDIN_CLIENT_ID,
    client_secret: process.env.LINKEDIN_CLIENT_SECRET,
    redirect_uri: "https://backend.votly.app/api/linkedin/callback",
  });
  const response = await fetch(
    "https://www.linkedin.com/oauth/v2/accessToken",
    {
      method: "post",
      headers: {
        "Content-type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    }
  );

  if (!response.ok) {
    throw new Error(response.statusText);
  }

  const accessToken = await response.json();
  return accessToken;
};

const getUserData = async (accessToken) => {
  const response = await fetch("https://api.linkedin.com/v2/userinfo", {
    method: "get",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(response.statusText);
  }

  const userData = await response.json();
  return userData;
};

module.exports = {
linkedInCallback : async  function (req, res)  {
  try {
    const { code } = req.query;

    // get access token
    const accessToken = await getAccessToken(code);

    // get user data using access token

    const userData = await getUserData(accessToken.access_token);

    if (!userData) {
      return res.status(500).json({
        success: false,
        error,
      });
    }

    // check if user registered
    let user;

    user = await User.findOne({ email: userData.email });

    if (!user) {
      user = new User({
        username: userData.name,
        email: userData.email,
        avatar: userData?.picture,
      });
      await user.save();
    }

    const token = jwt.sign(
      { name: user.username, 
        email: user.email, 
        avatar: user.avatar },
      process.env.JWT_SECRET
    );

    res.cookie("access_token", token, {
         httpOnly: true,
    });

    res.redirect("https://staging.votly.co/dashboard");
  } catch (error) {
    res.status(500).json({
      success: false,
      error,
    });
  }
},

 getUser:  async function (req, res) {
  const token = req.cookies.token;
  if (!token) {
    res.status(403).json({
      success: false,
    });
  }

  const user = jwt.verify(token, process.env.JWT_SECRET);
  res.status(200).json({
    success: true,
    user,
  });
}
}
