import { ReviewPaceSchema } from '@nts/shared';
import { createZodDto } from 'nestjs-zod';

export class ReviewPaceDto extends createZodDto(ReviewPaceSchema) {}
