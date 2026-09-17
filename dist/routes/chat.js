import { Router } from "express";
import { getMessages, sendMessages } from "../controllers/chatController.js";
const router = Router();
router.get('/:roomId', getMessages);
router.post('/:roomId', sendMessages);
export default router;
//# sourceMappingURL=chat.js.map