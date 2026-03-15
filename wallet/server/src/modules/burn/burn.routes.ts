import { Router } from 'express'
import * as BurnController from './burn.controller'

export const router = Router()

router.post('/burnSpam', BurnController.burnSpam)
