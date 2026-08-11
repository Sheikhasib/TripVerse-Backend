import { Request, Response } from "express";

const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    statusCode: 404,
    message: "Route not found",
    path: req.originalUrl,
    date: new Date(),
  });
};

export default notFoundHandler;
