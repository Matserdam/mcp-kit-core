import zodToJsonSchema from "zod-to-json-schema";
import { MCPJSONSchema, MCPSchemaDef } from "./types/toolkit";

export const getValidSchema = (schema?: MCPSchemaDef) : MCPJSONSchema | undefined => {
  if (schema?.zod) {
    const jsonSchema = zodToJsonSchema<"openApi3">(schema.zod, {
      $refStrategy: 'none', // keeps it self-contained, no $refs
    });
    return jsonSchema;
  }
  return schema?.jsonSchema;
}