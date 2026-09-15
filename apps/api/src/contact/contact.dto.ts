import type { ContactRequest } from '@hiddengem/shared';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/**
 * Validation for POST /api/contact. The global ValidationPipe rejects unknown
 * properties, so this class is the complete list of accepted fields.
 *
 * Length caps are defence in depth; escaping at render time (escape-html.ts) is
 * the primary control against injection.
 */
export class ContactRequestDto implements ContactRequest {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @Transform(trim)
  @IsEmail()
  @MaxLength(254)
  email: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  organization?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  topic?: string;

  @Transform(trim)
  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  message: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  recaptchaToken?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  source?: string;
}
