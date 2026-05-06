import { SetMetadata } from "@nestjs/common";
 
// permet de marquer les routes facilement
export const Roles = (...roles: string[] ) => SetMetadata('roles', roles);