import { ILike } from 'typeorm';

export function buildWhere(queryDto: any, searchableFields: string[], exactFields: string[] = []) {
  const where: any = {};
  
  searchableFields.forEach(field => {
    if (queryDto[field]) {
      where[field] = ILike(`%${queryDto[field]}%`);
    }
  });

  exactFields.forEach(field => {
    if (queryDto[field]) {
      where[field] = queryDto[field];
    }
  });

  return where;
}
