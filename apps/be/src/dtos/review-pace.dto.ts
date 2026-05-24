import { ReviewPaceSchema } from '@nts/dtos';
import { createZodDto } from 'nestjs-zod';

export class ReviewPaceDto extends createZodDto(ReviewPaceSchema) {}
