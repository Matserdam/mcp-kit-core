import { zodToJsonSchema } from "zod-to-json-schema";
import { MCPJSONSchema, MCPSchemaDef } from "./types/toolkit.d.ts";
import { ZodType, ZodTypeDef } from "zod";

export const getValidSchema = (schema?: MCPSchemaDef) : MCPJSONSchema | undefined => {
  if (schema?.zod) {
    const jsonSchema = zodToJsonSchema<"openApi3">(schema.zod as unknown as ZodType<unknown, ZodTypeDef, unknown>, {
      $refStrategy: 'none', // keeps it self-contained, no $refs
    });
    return jsonSchema;
  }
  return schema?.jsonSchema;
}