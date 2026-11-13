import { applyDecorators, Body, Param, Query } from '@nestjs/common';
import { ApiBody, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { z, type ZodObject, type ZodType } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe.js';

type SchemaObject = Extract<Parameters<typeof ApiBody>[0], { schema: unknown }>['schema'];

// One zod schema per request and response: it validates the input and becomes the OpenAPI
// contract the frontend's API client is generated from.
export function openApiSchema(schema: ZodType, io: 'input' | 'output' = 'output'): SchemaObject {
  const json: Record<string, unknown> = z.toJSONSchema(schema, {
    target: 'openapi-3.0',
    io,
    unrepresentable: 'any',
  });
  delete json.$schema;
  return json as SchemaObject;
}

export const ValidBody = <T>(schema: ZodType<T>) => Body(new ZodValidationPipe(schema));
export const ValidQuery = <T>(schema: ZodType<T>) => Query(new ZodValidationPipe(schema));
export const ValidParam = <T>(name: string, schema: ZodType<T>) =>
  Param(name, new ZodValidationPipe(schema));

export const Accepts = (schema: ZodType) =>
  ApiBody({ schema: openApiSchema(schema, 'input'), required: true });

export const Returns = (schema: ZodType, status = 200, description?: string) =>
  ApiResponse({ status, schema: openApiSchema(schema), description });

export const Fails = (...outcomes: [status: number, description: string][]) =>
  applyDecorators(...outcomes.map(([status, description]) => ApiResponse({ status, description })));

export const AcceptsQuery = (schema: ZodObject) => {
  const json = openApiSchema(schema, 'input') as {
    properties?: Record<string, SchemaObject>;
    required?: string[];
  };
  return applyDecorators(
    ...Object.entries(json.properties ?? {}).map(([name, property]) =>
      ApiQuery({ name, required: json.required?.includes(name) ?? false, schema: property }),
    ),
  );
};
