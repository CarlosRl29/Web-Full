import { JwtService } from "@nestjs/jwt";
import { ConflictException } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { AuthService } from "../src/auth/auth.service";

describe("AuthService", () => {
  it("register creates user and returns tokens", async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: "user-1",
          email: "user@test.com",
          role: UserRole.USER
        }),
        update: jest.fn().mockResolvedValue({})
      }
    } as any;

    const jwt = {
      signAsync: jest.fn().mockResolvedValue("token"),
      verifyAsync: jest.fn()
    } as unknown as JwtService;

    const service = new AuthService(prisma, jwt);

    const result = await service.register({
      email: "user@test.com",
      full_name: "User",
      password: "StrongPass1",
      intended_mode: "USER"
    });

    expect(result.access_token).toBe("token");
    expect(result.refresh_token).toBe("token");
    expect(prisma.user.create).toHaveBeenCalled();
    expect(prisma.user.update).toHaveBeenCalled();
  });

  it("register throws if email already exists", async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: "x" }),
        create: jest.fn(),
        update: jest.fn()
      }
    } as any;
    const jwt = { signAsync: jest.fn(), verifyAsync: jest.fn() } as unknown as JwtService;

    const service = new AuthService(prisma, jwt);

    await expect(
      service.register({
        email: "existing@test.com",
        full_name: "Existing",
        password: "StrongPass1",
        intended_mode: "USER"
      })
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
