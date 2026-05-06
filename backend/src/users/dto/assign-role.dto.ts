import { IsNotEmpty, IsString } from "class-validator";

export class AssignRoleDto {
    @IsString()
    @IsNotEmpty({ message: "Votre role est requis" })
    roleName!: string;
}