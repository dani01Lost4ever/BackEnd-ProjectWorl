import { NextFunction, Response } from "express";
import { TypedRequest } from "../../utils/typed-request.interface";
import { AddUserDTO, ChangePasswordDTO, LoginDTO } from "./auth.dto";
import { omit, pick } from "lodash";
import LogService from "../log/log.service";
import passport from "passport";
import * as jwt from "jsonwebtoken";
import BankAccountService from "../bank-account/bank-account.service";
import { BankAccount } from "../bank-account/bank-account.model";
import { NotFoundError } from "../../errors/not-found";

//const JWT_SECRET = "secret";
export const add = async (
  req: TypedRequest<AddUserDTO>,
  res: Response,
  next: NextFunction
) => {
  try {
    const userData = omit(req.body, "username", "password", "confermaPassword");
    const credentials = pick(
      req.body,
      "username",
      "password",
      "confermaPassword"
    );
    const newUser = await BankAccountService.add(userData, credentials);
    res.status(201).json(newUser);
  } catch (err) {
    next(err);
  }
};

export const login = async (
  req: TypedRequest<LoginDTO>,
  res: Response,
  next: NextFunction
) => {
  passport.authenticate("local", (err, bankaccount, info) => {
    //console.log("paaport auth");
    if (err) {
      return next(err);
    }
    if (!bankaccount) {
      LogService.newLog(
        req.ip,
        new Date(),
        `Failed attempt to login by ${bankaccount?.username}`
      );
      res.sendStatus(401);
      res.json({
        error: "LoginError",
        code: info.message,
      });
      return;
    }
    //generate token
    const token = jwt.sign(bankaccount, process.env.JWT_SECRET || "", {
      expiresIn: "7 days",
    });
    res.status(200);
    res.json({
      user: bankaccount,
      token,
    });
  })(req, res, next);
};

export const changePassword = async (
  req: TypedRequest<ChangePasswordDTO>,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = new BankAccount(req.user!);
    const userId = user!.id;
    const { oldPassword, newPassword } = req.body;

    if (oldPassword === newPassword) {
      res.status(400);
      res.json({
        error: "PasswordValidationError",
        message: "New password must be different from the last one",
      });
      return;
    }
    if (!req.user) {
      return res.status(404).json({ message: "User not found" });
    }

    const modifiedUser = await BankAccountService.update(
      userId!,
      newPassword,
      oldPassword
    );

    res.status(200);
    res.json({
      modifiedUser,
      message: "Password changed",
    });
  } catch (err) {
    if (err instanceof NotFoundError) {
      res.status(401);
      res.send(err.message);
    } else {
      next(err);
    }
  }
};
