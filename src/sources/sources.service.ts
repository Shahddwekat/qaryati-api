import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { AuditAction, Prisma, UserRole } from '../generated/prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUserData } from '../common/decorators/current-user.decorator';
import { CreateSourceDto } from './dto/create-source.dto';
import { ListSourcesQueryDto } from './dto/list-sources-query.dto';
import { UpdateSourceDto } from './dto/update-source.dto';

const AUDIT_ENTITY = 'source'; // snake_case, same convention as the heritage module

type SourceRow = Prisma.SourceGetPayload<object>;

@Injectable()
export class SourcesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
    ) { }

    async list(query: ListSourcesQueryDto) {
        const where: Prisma.SourceWhereInput = {
            ...(query.type && { type: query.type }),
            ...(query.q?.trim() && {
                OR: [
                    { title: { contains: query.q.trim() } },
                    { author: { contains: query.q.trim() } },
                    { publisher: { contains: query.q.trim() } },
                ],
            }),
        };

        const [items, total] = await this.prisma.$transaction([
            this.prisma.source.findMany({
                where,
                orderBy: [{ [query.sortBy]: query.order }, { id: 'asc' }],
                skip: (query.page - 1) * query.limit,
                take: query.limit,
            }),
            this.prisma.source.count({ where }),
        ]);

        return {
            data: items,
            meta: {
                page: query.page,
                limit: query.limit,
                total,
                totalPages: Math.ceil(total / query.limit),
            },
        };
    }

    async findOne(id: number): Promise<SourceRow> {
        const source = await this.prisma.source.findUnique({ where: { id } });
        if (!source) {
            throw new NotFoundException(`Source #${id} not found`);
        }
        return source;
    }

    async create(
        dto: CreateSourceDto,
        user: CurrentUserData,
        ipAddress?: string,
    ): Promise<SourceRow> {
        this.assertYearNotInFuture(dto.year);
        await this.assertNotDuplicate(dto.type, dto.title, dto.year ?? null);

        return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            const created = await tx.source.create({
                data: {
                    type: dto.type,
                    title: dto.title.trim(),
                    author: dto.author,
                    publisher: dto.publisher,
                    year: dto.year,
                    url: dto.url,
                    accessedAt: dto.accessedAt ? new Date(dto.accessedAt) : undefined,
                    createdBy: user.id,
                },
            });

            await this.audit.log(
                {
                    userId: user.id,
                    action: AuditAction.CREATE,
                    entityType: AUDIT_ENTITY,
                    entityId: created.id,
                    afterData: this.snapshot(created),
                    ipAddress,
                },
                tx,
            );
            return created;
        });
    }

    async update(
        id: number,
        dto: UpdateSourceDto,
        user: CurrentUserData,
        ipAddress?: string,
    ): Promise<SourceRow> {
        // A DTO built by ValidationPipe has every field defined (as undefined), so
        // Object.keys(dto) is never empty. Check the values instead.
        if (Object.values(dto).every((value) => value === undefined)) {
            throw new BadRequestException('Provide at least one field to update');
        }
        this.assertYearNotInFuture(dto.year);

        const existing = await this.findOne(id);
        this.assertCanEdit(existing, user);

        const nextType = dto.type ?? existing.type;
        const nextTitle = dto.title ?? existing.title;
        const nextYear = dto.year ?? existing.year;
        await this.assertNotDuplicate(nextType, nextTitle, nextYear, id);

        return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            const updated = await tx.source.update({
                where: { id },
                data: {
                    type: dto.type,
                    title: dto.title?.trim(),
                    author: dto.author,
                    publisher: dto.publisher,
                    year: dto.year,
                    url: dto.url,
                    accessedAt: dto.accessedAt ? new Date(dto.accessedAt) : undefined,
                },
            });

            await this.audit.log(
                {
                    userId: user.id,
                    action: AuditAction.UPDATE,
                    entityType: AUDIT_ENTITY,
                    entityId: id,
                    beforeData: this.snapshot(existing),
                    afterData: this.snapshot(updated),
                    ipAddress,
                },
                tx,
            );
            return updated;
        });
    }

    // ───────────────────────── rules ─────────────────────────

    /** The creator may edit their own source; VERIFIER and ADMIN may edit any. */
    private assertCanEdit(source: SourceRow, user: CurrentUserData): void {
        const isReviewer =
            user.role === UserRole.VERIFIER || user.role === UserRole.ADMIN;
        if (source.createdBy !== user.id && !isReviewer) {
            throw new ForbiddenException(
                'Only the creator, a VERIFIER or an ADMIN can edit this source',
            );
        }
    }

    private assertYearNotInFuture(year?: number): void {
        if (year !== undefined && year > new Date().getFullYear()) {
            throw new BadRequestException(
                'Publication year cannot be in the future',
            );
        }
    }

    /** Same type + title + year is the same reference: reuse it instead of duplicating. */
    private async assertNotDuplicate(
        type: SourceRow['type'],
        title: string,
        year: number | null,
        ignoreId?: number,
    ): Promise<void> {
        const duplicate = await this.prisma.source.findFirst({
            where: {
                type,
                title: title.trim(),
                year,
                ...(ignoreId !== undefined && { id: { not: ignoreId } }),
            },
            select: { id: true },
        });
        if (duplicate) {
            throw new ConflictException(
                `A source with the same type, title and year already exists (id ${duplicate.id})`,
            );
        }
    }

    /** JSON-safe copy for audit before/after (dates as ISO strings). */
    private snapshot(s: SourceRow): Prisma.InputJsonValue {
        return {
            type: s.type,
            title: s.title,
            author: s.author,
            publisher: s.publisher,
            year: s.year,
            url: s.url,
            accessedAt: s.accessedAt ? s.accessedAt.toISOString().slice(0, 10) : null,
            createdBy: s.createdBy,
        };
    }
}
