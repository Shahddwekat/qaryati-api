import { jest } from '@jest/globals';
import { NotFoundException } from '@nestjs/common';
import { GeographyService } from './geography.service';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any;
const mockFn = () => jest.fn<AnyFn>();

function setup() {
  const prisma = {
    governorate: { findMany: mockFn(), findUnique: mockFn() },
    municipality: { findMany: mockFn().mockResolvedValue([]) },
  };
  return { service: new GeographyService(prisma as never), prisma };
}

describe('GeographyService', () => {
  it('lists governorates with the number of visible villages', async () => {
    const { service, prisma } = setup();
    prisma.governorate.findMany.mockResolvedValue([
      { id: 4, nameAr: 'نابلس', nameEn: 'Nablus', _count: { villages: 2 } },
    ]);

    expect(await service.listGovernorates()).toEqual([
      { id: 4, nameAr: 'نابلس', nameEn: 'Nablus', villagesCount: 2 },
    ]);
    const select = prisma.governorate.findMany.mock.calls[0][0].select;
    expect(select._count.select.villages.where).toEqual({ deletedAt: null });
  });

  it('lists the municipalities of an existing governorate', async () => {
    const { service, prisma } = setup();
    prisma.governorate.findUnique.mockResolvedValue({ id: 4 });

    await service.listMunicipalities(4);

    expect(prisma.municipality.findMany.mock.calls[0][0].where).toEqual({
      governorateId: 4,
    });
  });

  it('returns 404 for an unknown governorate', async () => {
    const { service, prisma } = setup();
    prisma.governorate.findUnique.mockResolvedValue(null);

    await expect(service.listMunicipalities(999)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.municipality.findMany).not.toHaveBeenCalled();
  });
});
