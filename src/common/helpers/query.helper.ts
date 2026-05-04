import { ILike } from 'typeorm';

export function buildWhere(queryDto: any, searchableFields: string[]) {
  const where: any = {};
  
  searchableFields.forEach(field => {
    if (queryDto[field]) {
      where[field] = ILike(`%${queryDto[field]}%`);
    }
  });

  return where;
}
