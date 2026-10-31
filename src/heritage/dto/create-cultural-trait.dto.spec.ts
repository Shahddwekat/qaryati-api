
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CulturalCategory } from '../../generated/prisma/client';
import { CreateCulturalTraitDto } from './create-cultural-trait.dto';

describe('CreateCulturalTraitDto', () => {
  const validTrait = {
    category: CulturalCategory.CRAFT,
    title: 'التطريز الفلسطيني',
    description: 'حرفة تراثية فلسطينية',
    sourceId: 1,
  };

  it('should accept valid cultural trait data', async () => {
    const dto = plainToInstance(CreateCulturalTraitDto, validTrait);

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('should reject an invalid cultural category', async () => {
    const dto = plainToInstance(CreateCulturalTraitDto, {
      ...validTrait,
      category: 'INVALID_CATEGORY',
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'category')).toBe(true);
  });

  it('should reject an empty title', async () => {
    const dto = plainToInstance(CreateCulturalTraitDto, {
      ...validTrait,
      title: '',
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'title')).toBe(true);
  });

  it('should reject an invalid source ID', async () => {
    const dto = plainToInstance(CreateCulturalTraitDto, {
      ...validTrait,
      sourceId: 0,
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'sourceId')).toBe(true);
  });
});
