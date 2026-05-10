export type LoginRequestBody = {
  userId: string;
  password: string;
};

export type RefreshRequestBody = {
  refreshToken: string;
};

export type ChangePasswordRequestBody = {
  userId: string;
  newPassword: string;
};

export type LogoutRequestBody = {
  refreshToken: string;
};

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
};
