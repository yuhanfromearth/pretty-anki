import {
  ReviewCardSchema,
  AnswerCardSchema,
  RescheduleCardSchema,
  ReviewSessionSchema,
} from '@nts/dtos';
import { createZodDto } from 'nestjs-zod';

export class ReviewCardDto extends createZodDto(ReviewCardSchema) {}
export class AnswerCardDto extends createZodDto(AnswerCardSchema) {}
export class RescheduleCardDto extends createZodDto(RescheduleCardSchema) {}
export class ReviewSessionDto extends createZodDto(ReviewSessionSchema) {}
