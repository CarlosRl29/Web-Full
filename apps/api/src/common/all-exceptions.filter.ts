import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus
} from "@nestjs/common";
import { Request, Response } from "express";

function normalizeErrorPayload(exception: unknown): { message: string; code?: string } {
  if (exception instanceof HttpException) {
    const res = exception.getResponse();
    if (typeof res === "object" && res !== null && "message" in res) {
      const msg = (res as { message?: string | string[] }).message;
      return {
        message: Array.isArray(msg) ? msg[0] ?? "Error" : (msg ?? "Error"),
        code: (res as { code?: string }).code
      };
    }
    return { message: exception.message };
  }
  if (exception && typeof exception === "object" && "name" in exception) {
    const err = exception as { name?: string; message?: string; code?: string };
    if (err.name === "PrismaClientKnownRequestError") {
      const code = err.code as string;
      const meta = (exception as { meta?: { target?: string[] } }).meta;
      if (code === "P2002") {
        const target = meta?.target?.join(", ") ?? "field";
        return { message: `Duplicate value for ${target}`, code };
      }
      if (code === "P2003") {
        return { message: "Related record not found", code };
      }
      if (code === "P2025") {
        return { message: "Record not found", code };
      }
      return { message: err.message ?? "Database error", code };
    }
    if (err.name === "PrismaClientValidationError") {
      return { message: err.message ?? "Validation error", code: "PRISMA_VALIDATION" };
    }
  }
  return {
    message: exception instanceof Error ? exception.message : "Internal server error"
  };
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const { message, code } = normalizeErrorPayload(exception);
    const payload = { message, ...(code ? { code } : {}) };

    if (!(exception instanceof HttpException)) {
      // eslint-disable-next-line no-console
      console.error(
        "[API Error]",
        request.method,
        request.url,
        exception instanceof Error ? exception.message : String(exception)
      );
      if (exception instanceof Error && exception.stack) {
        // eslint-disable-next-line no-console
        console.error(exception.stack);
      }
    }

    response.status(status).json({
      success: false,
      error: payload,
      timestamp: new Date().toISOString()
    });
  }
}
