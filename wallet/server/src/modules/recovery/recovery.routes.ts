import { Router } from 'express'
import * as RecoveryController from './recovery.controller'

export const router = Router()

router.post('/recover', RecoveryController.recoverDust)
