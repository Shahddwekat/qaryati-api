
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { LandmarkType } from '../../generated/prisma/client';
import { CreateLandmarkDto } from './create-landmark.dto';

describe('CreateLandmarkDto', () => {
  it('should reject an empty Arabic landmark name', async () => {
    const dto = plainToInstance(CreateLandmarkDto, {
      nameAr: '',
      type: LandmarkType.SPRING,
      sourceId: 1,
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'nameAr')).toBe(true);
  });

  
  it('should reject an invalid landmark type', async () => {
    const dto = plainToInstance(CreateLandmarkDto, {
      nameAr: 'نبع القرية',
      type: 'RESTAURANT',
      sourceId: 1,
    });

    const errors = await validate(dto);

    expect(
      errors.some((error) => error.property === 'type'),
    ).toBe(true);
  });

  
  it('should reject an invalid sourceId', async () => {
    const dto = plainToInstance(CreateLandmarkDto, {
      nameAr: 'نبع القرية',
      type: LandmarkType.SPRING,
      sourceId: -5,
    });

    const errors = await validate(dto);

    expect(
      errors.some((error) => error.property === 'sourceId'),
    ).toBe(true);
  });

  
  it('should reject invalid geographic coordinates', async () => {
    const dto = plainToInstance(CreateLandmarkDto, {
      nameAr: 'نبع القرية',
      type: LandmarkType.SPRING,
      sourceId: 1,
      latitude: 120,
      longitude: 200,
    });

    const errors = await validate(dto);

    expect(
      errors.some((error) => error.property === 'latitude'),
    ).toBe(true);

    expect(
      errors.some((error) => error.property === 'longitude'),
    ).toBe(true);
  });

  
  it('should accept valid landmark data', async () => {
    const dto = plainToInstance(CreateLandmarkDto, {
      nameAr: 'نبع القرية',
      nameEn: 'Village Spring',
      type: LandmarkType.SPRING,
      sourceId: 1,
      description: 'A historical spring',
      latitude: 32.2211,
      longitude: 35.2544,
      period: 'Ottoman Period',
      currentCondition: 'GOOD',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

});
