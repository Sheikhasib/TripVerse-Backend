import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import config from "../../config";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { IGatewayResult } from "./payment.interface";
import { paymentService } from "./payment.service";

const createPayment = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.id as string;

    const session = await paymentService.createPaymentSession(userId, req.body);

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.CREATED,
      message: "Payment session created successfully.",
      data: session,
    });
  },
);

// Public callback target — SSLCommerz POSTs here (server-to-server) after the
// shopper finishes at the gateway. We settle the payment, then bounce the
// browser to the frontend result page.
const confirmPayment = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const bookingId = String(req.query.bookingId);
    const tranId = String(req.query.tranId);
    const status = String(req.query.status ?? "fail");

    await paymentService.processGatewayResult(
      bookingId,
      tranId,
      req.body as IGatewayResult,
    );

    const redirectBase =
      config.is_production && config.frontend_url_prod
        ? config.frontend_url_prod
        : config.frontend_url_dev;
    const page = ["success", "fail", "cancel"].includes(status) ? status : "fail";

    res.redirect(302, `${redirectBase}/payment/${page}?bookingId=${bookingId}`);
  },
);

// Public IPN target — the gateway notifies us here independently of the
// redirect. Same idempotent settle; always answers 200 so the gateway stops retrying.
const ipn = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const bookingId = String(req.query.bookingId);
    const tranId = String(req.query.tranId);

    await paymentService.processGatewayResult(
      bookingId,
      tranId,
      req.body as IGatewayResult,
    );

    res.status(200).type("text/plain").send("OK");
  },
);

export const paymentController = {
  createPayment,
  confirmPayment,
  ipn,
};