
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
    FacilityType,
    FacilityStatus,
} from '../../generated/prisma/client';
import { CreateFacilityDto } from './create-facility.dto';

describe('CreateFacilityDto', () => {
    const validFacility = {
        type: FacilityType.SCHOOL,
        name: 'مدرسة القرية',
        status: FacilityStatus.ACTIVE,
        yearEstablished: 1990,
        latitude: 32.2211,
        longitude: 35.2544,
        sourceId: 1,
    };

    it('should accept valid facility data', async () => {
        const dto = plainToInstance(CreateFacilityDto, validFacility);

        const errors = await validate(dto);

        expect(errors).toHaveLength(0);
    });

    it('should reject an invalid facility type', async () => {
        const dto = plainToInstance(CreateFacilityDto, {
            ...validFacility,
            type: 'INVALID_TYPE',
        });

        const errors = await validate(dto);

        expect(errors.some((error) => error.property === 'type')).toBe(true);
    });

    it('should reject an invalid facility status', async () => {
        const dto = plainToInstance(CreateFacilityDto, {
            ...validFacility,
            status: 'UNKNOWN',
        });

        const errors = await validate(dto);

        expect(errors.some((error) => error.property === 'status')).toBe(true);
    });

    it('should reject an empty facility name', async () => {
        const dto = plainToInstance(CreateFacilityDto, {
            ...validFacility,
            name: '',
        });

        const errors = await validate(dto);

        expect(errors.some((error) => error.property === 'name')).toBe(true);
    });

    it('should reject an invalid source ID', async () => {
        const dto = plainToInstance(CreateFacilityDto, {
            ...validFacility,
            sourceId: 0,
        });

        const errors = await validate(dto);

        expect(errors.some((error) => error.property === 'sourceId')).toBe(true);
    });

    it('should accept a facility without optional fields', async () => {
        const dto = plainToInstance(CreateFacilityDto, {
            type: FacilityType.CLINIC,
            name: 'عيادة القرية',
            status: FacilityStatus.ACTIVE,
            sourceId: 1,
        });

        const errors = await validate(dto);

        expect(errors).toHaveLength(0);
    });
});
