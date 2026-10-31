
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  EconomicType,
  Importance,
} from '../../generated/prisma/client';
import { CreateEconomicActivityDto } from './create-economic-activity.dto';

describe('CreateEconomicActivityDto', () => {
  const validActivity = {
    type: EconomicType.AGRICULTURE,
    name: 'زراعة الزيتون',
    description: 'إنتاج الزيتون وزيت الزيتون',
    importance: Importance.MAIN,
    yearFrom: 1950,
    yearTo: 2020,
    sourceId: 1,
  };

  it('should accept valid economic activity data', async () => {
    const dto = plainToInstance(CreateEconomicActivityDto, validActivity);

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('should reject an invalid economic type', async () => {
    const dto = plainToInstance(CreateEconomicActivityDto, {
      ...validActivity,
      type: 'INVALID_TYPE',
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'type')).toBe(true);
  });

  it('should reject an invalid importance', async () => {
    const dto = plainToInstance(CreateEconomicActivityDto, {
      ...validActivity,
      importance: 'HIGH',
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'importance')).toBe(true);
  });

  it('should reject an empty name', async () => {
    const dto = plainToInstance(CreateEconomicActivityDto, {
      ...validActivity,
      name: '',
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'name')).toBe(true);
  });

  it('should reject an invalid source ID', async () => {
    const dto = plainToInstance(CreateEconomicActivityDto, {
      ...validActivity,
      sourceId: 0,
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'sourceId')).toBe(true);
  });

  it('should reject yearTo earlier than yearFrom', async () => {
    const dto = plainToInstance(CreateEconomicActivityDto, {
      ...validActivity,
      yearFrom: 2020,
      yearTo: 1950,
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'yearTo')).toBe(true);
  });

  
it('should accept an economic activity without years', async () => {
  const dto = plainToInstance(CreateEconomicActivityDto, {
    type: EconomicType.AGRICULTURE,
    name: 'زراعة الزيتون',
    importance: Importance.MAIN,
    sourceId: 1,
  });

  const errors = await validate(dto);

  expect(errors).toHaveLength(0);
});


it('should accept yearTo without yearFrom', async () => {
  const dto = plainToInstance(CreateEconomicActivityDto, {
    type: EconomicType.AGRICULTURE,
    name: 'زراعة الزيتون',
    importance: Importance.MAIN,
    yearTo: 1950,
    sourceId: 1,
  });

  const errors = await validate(dto);

  expect(errors).toHaveLength(0);
});

 
it('should accept yearTo without yearFrom', async () => {
  const dto = plainToInstance(CreateEconomicActivityDto, {
    type: EconomicType.AGRICULTURE,
    name: 'زراعة الزيتون',
    importance: Importance.MAIN,
    yearTo: 1950,
    sourceId: 1,
  });

  const errors = await validate(dto);

  expect(errors).toHaveLength(0);
});

});
