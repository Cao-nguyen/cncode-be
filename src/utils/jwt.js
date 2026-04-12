import jwt from "jsonwebtoken";

export const createToken = (user) => {
    return jwt.sign(
        {
            id: user._id,
            email: user.email,
            role: user.role
        },
        "secret",
        { expiresIn: "7d" }
    );
};