const {
  registerUser,
  loginUser,
  refreshSession,
  revokeRefreshToken,
  getCurrentUser,
  getCookieOptions,
} = require("../services/auth.service");

const setAuthCookies = (res, _accessToken, refreshToken) => {
  const cookieOptions = getCookieOptions();

  res.cookie("refreshToken", refreshToken, {
    ...cookieOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

const clearAuthCookies = (res) => {
  const cookieOptions = getCookieOptions();
  res.clearCookie("refreshToken", cookieOptions);
};

const register = async (req, res, next) => {
  try {
    const payload = await registerUser(req.validated.body);
    setAuthCookies(res, payload.accessToken, payload.refreshToken);

    return res.status(201).json({
      message: "User registered successfully",
      user: payload.user,
      accessToken: payload.accessToken,
    });
  } catch (error) {
    return next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const payload = await loginUser(req.validated.body);
    setAuthCookies(res, payload.accessToken, payload.refreshToken);

    return res.status(200).json({
      message: "Login successful",
      user: payload.user,
      accessToken: payload.accessToken,
    });
  } catch (error) {
    return next(error);
  }
};

const refresh = async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    const payload = await refreshSession(refreshToken);
    setAuthCookies(res, payload.accessToken, payload.refreshToken);

    return res.status(200).json({
      message: "Session refreshed",
      user: payload.user,
      accessToken: payload.accessToken,
    });
  } catch (error) {
    return next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    await revokeRefreshToken(req.cookies?.refreshToken);
    clearAuthCookies(res);

    return res.status(200).json({
      message: "Logged out successfully",
    });
  } catch (error) {
    return next(error);
  }
};

const me = async (req, res, next) => {
  try {
    const payload = await getCurrentUser(req.user.id);

    return res.status(200).json(payload);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  register,
  login,
  refresh,
  logout,
  me,
};
