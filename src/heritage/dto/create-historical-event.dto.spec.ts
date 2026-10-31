
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  EventCategory,
  DatePrecision,
} from '../../generated/prisma/client';
import { CreateHistoricalEventDto } from './create-historical-event.dto';

describe('CreateHistoricalEventDto', () => {
  const validEvent = {
    title: 'Historical Event',
    description: 'An important event in village history',
    category: EventCategory.CULTURAL,
    datePrecision: DatePrecision.YEAR,
    yearFrom: 1948,
    yearTo: 1950,
    sourceId: 1,
    villageIds: [1, 2],
  };

  it('should accept a valid year range', async () => {
    const dto = plainToInstance(CreateHistoricalEventDto, validEvent);

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('should reject a yearTo earlier than yearFrom', async () => {
    const dto = plainToInstance(CreateHistoricalEventDto, {
      ...validEvent,
      yearFrom: 1950,
      yearTo: 1948,
    });

    const errors = await validate(dto);

    expect(
      errors.some((error) => error.property === 'yearTo'),
    ).toBe(true);
  });

  
  it('should reject duplicate village IDs', async () => {
    const dto = plainToInstance(CreateHistoricalEventDto, {
      ...validEvent,
      villageIds: [1, 1, 2],
    });

    const errors = await validate(dto);

    expect(
      errors.some((error) => error.property === 'villageIds'),
    ).toBe(true);
  });

  
  it('should reject an empty village list', async () => {
    const dto = plainToInstance(CreateHistoricalEventDto, {
      ...validEvent,
      villageIds: [],
    });

    const errors = await validate(dto);

    expect(
      errors.some((error) => error.property === 'villageIds'),
    ).toBe(true);
  });

});
