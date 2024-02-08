import { zValidator } from "@hono/zod-validator";
import { Client, Receiver } from "@upstash/qstash";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

type Variables = {
  UPSTASH_NEXT_SIGNING_KEY: string;
  UPSTASH_CURRENT_SIGNING_KEY: string;
  UPSTASH_TOKEN: string;
};
type GlobalContext = {
  Bindings: Variables;
};
const app = new Hono<GlobalContext>();
app.use("/qstash/*", async (c, next) => {
  const signature =
    c.req.header("Upstash-Signature") ?? c.req.header("upstash-signature");
  if (!signature) throw new HTTPException(401, { message: "Missing header" });
  const text = await c.req.text();
  const isValid = new Receiver({
    nextSigningKey: c.env.UPSTASH_NEXT_SIGNING_KEY,
    currentSigningKey: c.env.UPSTASH_CURRENT_SIGNING_KEY,
  }).verify({
    signature,
    body: text,
  });
  if (!isValid) throw new HTTPException(401, { message: "Invalid message" });
  return next();
});
app.get("/", (c) => {
  return c.text("Hello Hono!");
});
app.post("/create", async (c) => {
  const qstashClient = new Client({ token: c.env.UPSTASH_TOKEN });
  const message = await qstashClient.publishJSON({
    topic: "sandbox",
    body: {
      listingId: "1251251231",
    },
    delay: 0.1 * 60,
    contentBasedDeduplication: true,
  });
  if (!message)
    throw new HTTPException(500, { message: "Failed to create message" });
  console.log(message);
  return c.text("success");
});
// Results in malformed json in request body
app.post(
  "/qstash/expire",
  zValidator(
    "json",
    z.object({
      listingId: z.string(),
    }),
  ),
  async (c) => {
    const text = await c.req.text();
    const parsedInput = z
      .object({
        listingId: z.string(),
      })
      .parse(JSON.parse(text));
    console.log(parsedInput);
    return c.text("success");
  },
);
export default app;
