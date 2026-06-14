import {
  ReviewCardSchema,
  AnswerCardSchema,
  RescheduleCardSchema,
  ReviewSessionSchema,
  UndoReviewSchema,
} from '@nts/shared';
import { createZodDto } from 'nestjs-zod';

export class ReviewCardDto extends createZodDto(ReviewCardSchema) {}
export class AnswerCardDto extends createZodDto(AnswerCardSchema) {}
export class RescheduleCardDto extends createZodDto(RescheduleCardSchema) {}
export class ReviewSessionDto extends createZodDto(ReviewSessionSchema) {}
export class UndoReviewDto extends createZodDto(UndoReviewSchema) {}
