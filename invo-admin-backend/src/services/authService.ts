import jwt from 'jsonwebtoken';
import User, { IUser, UserRole } from '../models/User';

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
  name: string;
}

export const signToken = (payload: JwtPayload): string =>
  jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);

export const verifyToken = (token: string): JwtPayload =>
  jwt.verify(token, JWT_SECRET) as JwtPayload;

export const login = async (
  email: string,
  password: string
): Promise<{ token: string; user: Omit<IUser, 'password'> }> => {
  const user = await User.findOne({ email: email.toLowerCase().trim(), isActive: true });
  if (!user) throw new Error('Invalid credentials');

  const ok = await user.comparePassword(password);
  if (!ok) throw new Error('Invalid credentials');

  user.lastLoginAt = new Date();
  await user.save();

  const token = signToken({
    userId: String(user._id),
    email: user.email,
    role: user.role,
    name: user.name
  });

  return { token, user: user.toJSON() as any };
};
