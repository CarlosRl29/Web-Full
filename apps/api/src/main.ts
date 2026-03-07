import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/all-exceptions.filter";
import { PrismaService } from "./prisma/prisma.service";

const DEFAULT_ACCESS = "super-access-secret";
const DEFAULT_REFRESH = "super-refresh-secret";

function ensureProductionSecrets() {
  if (process.env.NODE_ENV !== "production") return;
  const access = process.env.JWT_ACCESS_SECRET ?? DEFAULT_ACCESS;
  const refresh = process.env.JWT_REFRESH_SECRET ?? DEFAULT_REFRESH;
  if (access === DEFAULT_ACCESS || refresh === DEFAULT_REFRESH) {
    console.error(
      "FATAL: In production, set JWT_ACCESS_SECRET and JWT_REFRESH_SECRET to strong values. " +
        "Do not use default secrets. See apps/api/.env.example"
    );
    process.exit(1);
  }
}

async function bootstrap() {
  ensureProductionSecrets();
  const app = await NestFactory.create(AppModule, { cors: true });
  app.setGlobalPrefix("api");
  app.useGlobalFilters(new AllExceptionsFilter());

  const prismaService = app.get(PrismaService);
  await prismaService.enableShutdownHooks(app);

  const port = Number(process.env.PORT ?? process.env.API_PORT ?? 3001);
  await app.listen(port);
}

bootstrap();
