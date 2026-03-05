import { Router } from "express";
import { userRouter } from "./user.routes.js";
import { threadsRouter } from "./threads.routes.js";
import { notificationsRouter } from "./notifications.routes.js";
import { chatRouter } from "./chat.routes.js";
import { uploadRouter } from "./upload.routes.js";

export const apiRouter = Router();

apiRouter.use("/me", userRouter);

apiRouter.use("/threads", threadsRouter);

apiRouter.use("/notifications", notificationsRouter);

apiRouter.use("/chat", chatRouter);

apiRouter.use("/upload", uploadRouter);
