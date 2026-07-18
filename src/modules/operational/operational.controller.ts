import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { OperationalService } from './operational.service';
import { CreateActividadDto } from './dto/create-actividad.dto';
import { UpdateActividadDto } from './dto/update-actividad.dto';
import { QueryActividadDto } from './dto/query-actividad.dto';
import { CreateInsumoDto } from './dto/create-insumo.dto';
import { UpdateInsumoDto } from './dto/update-insumo.dto';
import { QueryInsumoDto } from './dto/query-insumo.dto';
import { CreateServicioDto } from './dto/create-servicio.dto';
import { UpdateServicioDto } from './dto/update-servicio.dto';
import { QueryServicioDto } from './dto/query-servicio.dto';
import { CreateServicioActividadDto } from './dto/create-servicio-actividad.dto';
import { UpdateServicioActividadDto } from './dto/update-servicio-actividad.dto';
import { QueryServicioActividadDto } from './dto/query-servicio-actividad.dto';
import { CreateProgramadoDto } from './dto/create-programado.dto';
import { QueryProgramadosDto } from './dto/query-programados.dto';
import { ChangeStateDto } from './dto/change-state.dto';
import { CancelDto } from './dto/cancel.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('operational')
@UseGuards(JwtAuthGuard)
export class OperationalController {
  constructor(
    private readonly operationalService: OperationalService,
  ) {}

  // --- Actividad Endpoints ---

  @Post('actividades')
  createActividad(@Body() createDto: CreateActividadDto) {
    return this.operationalService.createActividad(createDto);
  }

  @Get('actividades')
  findAllActividades(@Query() queryDto: QueryActividadDto) {
    return this.operationalService.findAllActividades(queryDto);
  }

  @Get('actividades/:id')
  findOneActividad(@Param('id', ParseUUIDPipe) id: string) {
    return this.operationalService.findOneActividad(id);
  }

  @Patch('actividades/:id')
  updateActividad(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateActividadDto,
  ) {
    return this.operationalService.updateActividad(id, updateDto);
  }

  @Delete('actividades/:id')
  removeActividad(@Param('id', ParseUUIDPipe) id: string) {
    return this.operationalService.removeActividad(id);
  }

  // --- Insumo Endpoints ---

  @Post('insumos')
  createInsumo(@Body() createDto: CreateInsumoDto) {
    return this.operationalService.createInsumo(createDto);
  }

  @Get('insumos')
  findAllInsumos(@Query() queryDto: QueryInsumoDto) {
    return this.operationalService.findAllInsumos(queryDto);
  }

  @Get('insumos/:id')
  findOneInsumo(@Param('id', ParseUUIDPipe) id: string) {
    return this.operationalService.findOneInsumo(id);
  }

  @Patch('insumos/:id')
  updateInsumo(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateInsumoDto,
  ) {
    return this.operationalService.updateInsumo(id, updateDto);
  }

  @Delete('insumos/:id')
  removeInsumo(@Param('id', ParseUUIDPipe) id: string) {
    return this.operationalService.removeInsumo(id);
  }

  // --- Servicio Endpoints ---

  @Post('servicios')
  createServicio(@Body() createDto: CreateServicioDto) {
    return this.operationalService.createServicio(createDto);
  }

  @Get('servicios')
  findAllServicios(@Query() queryDto: QueryServicioDto) {
    return this.operationalService.findAllServicios(queryDto);
  }

  @Get('servicios/:id')
  findOneServicio(@Param('id', ParseUUIDPipe) id: string) {
    return this.operationalService.findOneServicio(id);
  }

  @Patch('servicios/:id')
  updateServicio(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateServicioDto,
  ) {
    return this.operationalService.updateServicio(id, updateDto);
  }

  @Delete('servicios/:id')
  removeServicio(@Param('id', ParseUUIDPipe) id: string) {
    return this.operationalService.removeServicio(id);
  }

  // ── Nested Servicio → Actividad endpoints ──

  @Post('servicios/:servicioId/actividades')
  addActividadToServicio(
    @Param('servicioId', ParseUUIDPipe) servicioId: string,
    @Body() createDto: CreateServicioActividadDto,
  ) {
    return this.operationalService.createServicioActividad({
      ...createDto,
      servicioId,
    });
  }

  @Delete('servicios/:servicioId/actividades/:actividadId')
  removeActividadFromServicio(
    @Param('servicioId', ParseUUIDPipe) servicioId: string,
    @Param('actividadId', ParseUUIDPipe) actividadId: string,
  ) {
    return this.operationalService.removeServicioActividadByRefs(servicioId, actividadId);
  }

  // --- ServicioActividad Endpoints ---

  @Post('servicio-actividades')
  createServicioActividad(@Body() createDto: CreateServicioActividadDto) {
    return this.operationalService.createServicioActividad(createDto);
  }

  @Get('servicio-actividades')
  findAllServicioActividades(@Query() queryDto: QueryServicioActividadDto) {
    return this.operationalService.findAllServicioActividades(queryDto);
  }

  @Get('servicio-actividades/:id')
  findOneServicioActividad(@Param('id', ParseUUIDPipe) id: string) {
    return this.operationalService.findOneServicioActividad(id);
  }

  @Patch('servicio-actividades/:id')
  updateServicioActividad(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateServicioActividadDto,
  ) {
    return this.operationalService.updateServicioActividad(id, updateDto);
  }

  @Delete('servicio-actividades/:id')
  removeServicioActividad(@Param('id', ParseUUIDPipe) id: string) {
    return this.operationalService.removeServicioActividad(id);
  }

  // ── Servicio Programado Endpoints ──

  @Post('servicio-programados')
  createProgramado(@Body() createDto: CreateProgramadoDto) {
    return this.operationalService.createProgramado(createDto);
  }

  @Get('servicio-programados')
  findAllProgramados(@Query() queryDto: QueryProgramadosDto) {
    return this.operationalService.findAllProgramados(queryDto);
  }

  @Get('servicio-programados/:id')
  findOneProgramado(@Param('id', ParseUUIDPipe) id: string) {
    return this.operationalService.findOneProgramado(id);
  }

  @Patch('servicio-programados/:id/state')
  changeState(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeStateDto,
  ) {
    return this.operationalService.changeState(id, dto);
  }

  @Post('servicio-programados/:id/cancel')
  cancelProgramado(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelDto,
  ) {
    return this.operationalService.cancelProgramado(id, dto);
  }
}
